import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GradientCard } from "@/components/ui/gradient-card";
import { 
  GraduationCap, 
  PlayCircle, 
  CheckCircle2, 
  Clock, 
  FileText, 
  Download,
  BookOpen,
  Award,
  ChevronRight,
  Loader2,
  Lock,
  Star,
  Trophy
} from "lucide-react";
import { toast } from "sonner";

type Lesson = {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  video_url: string | null;
  order: number;
  is_completed: boolean;
};

type Module = {
  id: string;
  title: string;
  description: string;
  order: number;
  lessons: Lesson[];
};

type Resource = {
  id: string;
  title: string;
  description: string;
  type: 'pdf' | 'template' | 'checklist' | 'guide';
  download_url: string;
};

type CourseData = {
  has_access: boolean;
  course?: {
    title: string;
    description: string;
    total_lessons: number;
    completed_lessons: number;
    progress_percent: number;
    modules: Module[];
    resources: Resource[];
    certificate_earned: boolean;
    started_at: string | null;
    last_accessed: string | null;
  };
  message?: string;
};

export function TrainingCourseWidget() {
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [completingLesson, setCompletingLesson] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery<CourseData>({
    queryKey: ['training-course-dashboard'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('training-course-dashboard');
      if (error) throw error;
      return data;
    }
  });

  const handleMarkComplete = async (lessonId: string) => {
    setCompletingLesson(lessonId);
    try {
      const { error } = await supabase.functions.invoke('training-course-progress', {
        body: { lessonId, action: 'complete' }
      });
      if (error) throw error;
      toast.success('Lesson completed! Great progress!');
      refetch();
    } catch {
      toast.error('Failed to update progress');
    } finally {
      setCompletingLesson(null);
    }
  };

  const getResourceIcon = (type: string) => {
    switch (type) {
      case 'pdf': return FileText;
      case 'template': return FileText;
      case 'checklist': return CheckCircle2;
      case 'guide': return BookOpen;
      default: return FileText;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.has_access) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center">
          <GraduationCap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Exclusive Training Course</h3>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            {data?.message || 'Purchase this course from the Merchant Market to access comprehensive training on growing your business on PawBucks.'}
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <a href="/merchant/market">View Merchant Market</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const course = data.course!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            {course.title}
          </h2>
          <p className="text-muted-foreground">
            {course.description}
          </p>
        </div>
        {course.certificate_earned && (
          <Badge className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white gap-1 self-start">
            <Trophy className="h-3 w-3" /> Certificate Earned
          </Badge>
        )}
      </div>

      {/* Progress Overview */}
      <GradientCard gradient>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-5 w-5 text-primary" />
              <span className="font-semibold">Course Progress</span>
            </div>
            <div className="flex items-center gap-4">
              <Progress value={course.progress_percent} className="flex-1 h-3" />
              <span className="text-sm font-medium min-w-[60px]">
                {course.progress_percent}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {course.completed_lessons} of {course.total_lessons} lessons completed
            </p>
          </div>
          <div className="flex flex-col gap-1 text-sm">
            {course.started_at && (
              <span className="text-muted-foreground">
                Started: {new Date(course.started_at).toLocaleDateString()}
              </span>
            )}
            {course.last_accessed && (
              <span className="text-muted-foreground">
                Last accessed: {new Date(course.last_accessed).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </GradientCard>

      {/* Video Player (when lesson selected) */}
      {activeLesson && (
        <Card className="overflow-hidden">
          <div className="aspect-video bg-black relative">
            {activeLesson.video_url ? (
              <iframe
                src={activeLesson.video_url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="text-center">
                  <PlayCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Video coming soon</p>
                  <p className="text-sm opacity-75">This lesson content is being prepared</p>
                </div>
              </div>
            )}
          </div>
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">{activeLesson.title}</h3>
                <p className="text-muted-foreground text-sm mt-1">{activeLesson.description}</p>
              </div>
              {!activeLesson.is_completed && (
                <Button
                  onClick={() => handleMarkComplete(activeLesson.id)}
                  disabled={completingLesson === activeLesson.id}
                  size="sm"
                >
                  {completingLesson === activeLesson.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                  )}
                  Mark Complete
                </Button>
              )}
              {activeLesson.is_completed && (
                <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Completed
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="lessons" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="lessons" className="gap-2">
            <PlayCircle className="h-4 w-4" /> Lessons
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-2">
            <FileText className="h-4 w-4" /> Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lessons">
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {course.modules.map((module, moduleIndex) => (
                <Card key={module.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-sm flex items-center justify-center font-medium">
                        {moduleIndex + 1}
                      </span>
                      {module.title}
                    </CardTitle>
                    <CardDescription>{module.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {module.lessons.map((lesson) => {
                        const isActive = activeLesson?.id === lesson.id;
                        return (
                          <button
                            key={lesson.id}
                            onClick={() => setActiveLesson(lesson)}
                            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                              isActive 
                                ? 'bg-primary/10 border border-primary/20' 
                                : 'hover:bg-muted/50 border border-transparent'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              lesson.is_completed 
                                ? 'bg-success/10 text-success' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {lesson.is_completed ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <PlayCircle className="h-4 w-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium text-sm truncate ${lesson.is_completed ? 'text-muted-foreground' : ''}`}>
                                {lesson.title}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {lesson.duration_minutes} min
                              </div>
                            </div>
                            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isActive ? 'rotate-90' : ''}`} />
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="resources">
          <div className="grid gap-4 md:grid-cols-2">
            {course.resources.map((resource) => {
              const Icon = getResourceIcon(resource.type);
              return (
                <Card key={resource.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">{resource.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{resource.description}</p>
                        <Badge variant="outline" className="mt-2 text-xs capitalize">
                          {resource.type}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          toast.success('Downloading resource...');
                          // In production, this would trigger actual download
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Certificate Section */}
      {course.progress_percent === 100 && (
        <GradientCard gradient className="text-center">
          <Trophy className="h-12 w-12 text-warning mx-auto mb-4" />
          <h3 className="text-xl font-bold mb-2">Congratulations!</h3>
          <p className="text-muted-foreground mb-4">
            You've completed the PawBucks Merchant Training Course
          </p>
          <Button className="gap-2">
            <Award className="h-4 w-4" />
            Download Certificate
          </Button>
        </GradientCard>
      )}
    </div>
  );
}
